"""
Wavers Points — market-aligned gift loyalty.

Market snapshot (Kenya / East Africa retail, 2025–2026):
- OneSeed Kenya ≈ $1 / tree
- TreePassport Kenya ≈ $2 (≈ KSh 250)
- Greenr / Word Forest / Carbon Footprint ≈ $2–£3 / tree
- Climate Wavers projects ≈ $2–$5 / tree (seed data)

Economy:
- 100 points = $1 USD of tree value
- Gift earn rate = 10% of gifted tree value (typical loyalty cash-back band)
- Redeem 1 tree = full project tree_price in points

Example at $2 / tree:
- Gift 1 tree → earn 20 points
- Redeem 1 tree → 200 points
- ≈ 10 gifted trees → 1 free tree
"""

from __future__ import annotations

import math
import uuid
from decimal import Decimal, ROUND_CEILING

from django.db import transaction
from django.db.models import F

from .models import TreeProject, TreeProjectDonation, WaversPointsAccount, WaversPointsLedger

POINTS_PER_USD = 100
GIFT_EARN_RATE = Decimal("0.10")

MARKET_NOTES = {
    "points_per_usd": POINTS_PER_USD,
    "gift_earn_rate": float(GIFT_EARN_RATE),
    "market_kenya_usd": {"low": 1.0, "typical": 2.0, "high": 3.0},
    "platform_projects_usd": {"low": 2.0, "high": 5.0},
    "summary": (
        "Kenya market trees usually cost $1–$3. Climate Wavers projects are $2–$5. "
        "Gifting earns 10% back in points; redeeming spends the full tree price in points."
    ),
}


def _as_money(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def points_for_usd(amount_usd) -> int:
    cents = (_as_money(amount_usd) * Decimal(POINTS_PER_USD)).quantize(
        Decimal("1"), rounding=ROUND_CEILING
    )
    return max(int(cents), 0)


def gift_earn_points(trees: int, tree_price_usd) -> int:
    trees = max(int(trees or 0), 0)
    value = _as_money(tree_price_usd) * Decimal(trees)
    return points_for_usd(value * GIFT_EARN_RATE)


def redeem_cost_points(tree_price_usd, trees: int = 1) -> int:
    trees = max(int(trees or 1), 1)
    return points_for_usd(_as_money(tree_price_usd) * Decimal(trees))


def get_or_create_account(user) -> WaversPointsAccount:
    account, _ = WaversPointsAccount.objects.get_or_create(user=user)
    return account


def account_payload(user, project: TreeProject | None = None):
    if not user or not getattr(user, "is_authenticated", False):
        return {
            "balance": 0,
            "lifetime_earned": 0,
            "lifetime_redeemed": 0,
            "rates": MARKET_NOTES,
            "redeem_cost_for_project": None,
        }
    account = get_or_create_account(user)
    redeem_cost = None
    trees_until_free = None
    if project is not None:
        redeem_cost = redeem_cost_points(project.tree_price, 1)
        earn_one = gift_earn_points(1, project.tree_price)
        if earn_one > 0:
            trees_until_free = math.ceil(redeem_cost / earn_one)
    return {
        "balance": account.balance,
        "lifetime_earned": account.lifetime_earned,
        "lifetime_redeemed": account.lifetime_redeemed,
        "rates": MARKET_NOTES,
        "redeem_cost_for_project": redeem_cost,
        "trees_until_free": trees_until_free,
    }


@transaction.atomic
def credit_gift_points(donation: TreeProjectDonation):
    """Award points when a logged-in donor gifts trees to someone else."""
    if not donation or not donation.donor_id or not donation.gifted_to_id:
        return 0
    if donation.donor_id == donation.gifted_to_id:
        return 0
    if donation.payment_status != "completed":
        return 0
    # Only paid gifts earn points (not points-redeemed free trees).
    if _as_money(donation.amount) <= 0:
        return 0
    ref = str(donation.payment_reference or "")
    if ref.startswith("POINTS-"):
        return 0
    if WaversPointsLedger.objects.filter(
        donation=donation, reason="gift_earn"
    ).exists():
        return 0

    project = donation.project
    points = gift_earn_points(donation.trees_purchased, project.tree_price)
    if points <= 0:
        return 0

    account = get_or_create_account(donation.donor)
    account.balance = F("balance") + points
    account.lifetime_earned = F("lifetime_earned") + points
    account.save(update_fields=["balance", "lifetime_earned", "updated_at"])
    account.refresh_from_db()

    WaversPointsLedger.objects.create(
        user=donation.donor,
        delta=points,
        balance_after=account.balance,
        reason="gift_earn",
        note=f"Gift reward for {donation.trees_purchased} tree(s) to user {donation.gifted_to_id}",
        donation=donation,
    )
    return points


@transaction.atomic
def redeem_trees_with_points(
    *,
    user,
    project: TreeProject,
    trees: int = 1,
    dedication_message: str = "",
    gifted_to=None,
):
    trees = max(int(trees or 1), 1)
    if trees > 50:
        raise ValueError("You can redeem at most 50 trees at once.")

    cost = redeem_cost_points(project.tree_price, trees)
    account = get_or_create_account(user)
    if account.balance < cost:
        raise ValueError(
            f"Not enough points. Need {cost}, you have {account.balance}."
        )

    account.balance = F("balance") - cost
    account.lifetime_redeemed = F("lifetime_redeemed") + cost
    account.save(update_fields=["balance", "lifetime_redeemed", "updated_at"])
    account.refresh_from_db()

    reference = f"POINTS-{uuid.uuid4().hex[:16].upper()}"
    note = (dedication_message or "").strip()
    if gifted_to is not None:
        label = f"{gifted_to.first_name} {gifted_to.last_name}".strip() or gifted_to.username
        note = f"{note}\n\nGifted to: {label}".strip()
    note = f"{note}\n\nRedeemed with {cost} Wavers Points".strip()

    donation = TreeProjectDonation.objects.create(
        project=project,
        donor=user,
        gifted_to=gifted_to,
        payer_email=getattr(user, "email", "") or "",
        amount=Decimal("0.00"),
        trees_purchased=trees,
        payment_reference=reference,
        payment_status="completed",
        dedication_message=note,
        is_anonymous=False,
    )
    project.trees_planted = F("trees_planted") + trees
    project.save(update_fields=["trees_planted"])
    project.refresh_from_db()

    WaversPointsLedger.objects.create(
        user=user,
        delta=-cost,
        balance_after=account.balance,
        reason="redeem_tree",
        note=f"Redeemed {trees} tree(s) on {project.name}",
        donation=donation,
    )

    return {
        "donation": donation,
        "points_spent": cost,
        "balance": account.balance,
        "trees": trees,
    }
