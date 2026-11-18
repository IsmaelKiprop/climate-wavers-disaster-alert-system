"""
Re-verify a Paystack charge and record the tree donation if missing.

Usage:
  python manage.py recover_paystack_payment 1795021773051
  python manage.py recover_paystack_payment 1795021773051 --project-id 3
"""

from django.core.management.base import BaseCommand, CommandError

from core.paystack_payment import PaymentRecordError, record_tree_payment


class Command(BaseCommand):
    help = "Recover a paid Paystack tree charge into Climate Wavers donations/impact."

    def add_arguments(self, parser):
        parser.add_argument("reference", type=str, help="Paystack payment reference")
        parser.add_argument(
            "--project-id",
            type=int,
            default=None,
            help="Force project id when Paystack metadata omitted it",
        )
        parser.add_argument(
            "--gifted-to",
            type=int,
            default=None,
            help="Optional gifted_to user id override",
        )
        parser.add_argument(
            "--trees",
            type=int,
            default=None,
            help="Optional trees_purchased override",
        )

    def handle(self, *args, **options):
        reference = str(options["reference"] or "").strip()
        if not reference:
            raise CommandError("Reference is required.")

        client_data = {}
        if options.get("project_id"):
            client_data["project_id"] = options["project_id"]
        if options.get("gifted_to"):
            client_data["gifted_to"] = options["gifted_to"]
        if options.get("trees"):
            client_data["trees_purchased"] = options["trees"]

        try:
            payload = record_tree_payment(reference, client_data=client_data)
        except PaymentRecordError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS("Payment recorded."))
        self.stdout.write(f"  donation_id: {payload.get('donation_id')}")
        self.stdout.write(f"  reference: {payload.get('payment_reference')}")
        trees = (payload.get("certificate_data") or {}).get("trees_planted")
        amount = (payload.get("certificate_data") or {}).get("amount")
        tree_type = (payload.get("certificate_data") or {}).get("tree_type")
        self.stdout.write(f"  project: {tree_type}")
        self.stdout.write(f"  trees: {trees}")
        self.stdout.write(f"  amount: {amount}")
