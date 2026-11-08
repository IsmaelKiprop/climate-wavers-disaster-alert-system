import { useEffect, useState } from "react";
import { FaTree } from "react-icons/fa";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";

const WaversPointsCard = ({ projectId = null }) => {
  const [data, setData] = useState(null);
  const [rates, setRates] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const query = projectId ? `?project_id=${projectId}` : "";
        const publicRates = await client.run(
          "get",
          `${endpoints.pointsRates}${query}`,
          {},
          false
        );
        if (!alive) return;
        setRates(publicRates);

        if (!getAuthToken()) {
          setData(null);
          return;
        }
        const balance = await client.run(
          "get",
          `${endpoints.pointsBalance}${query}`,
          {},
          true
        );
        if (alive) setData(balance);
      } catch {
        if (alive) setData(null);
      }
    };
    load();
    const onUpdate = () => load();
    window.addEventListener("waversPointsUpdated", onUpdate);
    return () => {
      alive = false;
      window.removeEventListener("waversPointsUpdated", onUpdate);
    };
  }, [projectId]);

  const example = rates?.example;
  const balance = data?.balance ?? 0;
  const redeemCost = data?.redeem_cost_for_project ?? example?.redeem_one_tree;

  return (
    <section className="border border-border bg-surface p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Wavers Points</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">
            {getAuthToken() ? balance.toLocaleString() : "—"}
          </p>
          <p className="mt-1 text-sm text-muted">
            Gift trees to earn points. Redeem points for a free tree.
          </p>
        </div>
        <div className="border border-border px-3 py-2 text-sm min-w-[180px]">
          <div className="flex items-center gap-2 font-medium">
            <FaTree className="text-primary" />
            Market rates
          </div>
          <p className="mt-1 text-muted text-xs leading-relaxed">
            Kenya trees typically $1–$3. Our projects $2–$5. Gift back 10%.
          </p>
        </div>
      </div>

      {example ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="border border-border p-3">
            <p className="text-xs text-muted">Earn per gifted tree</p>
            <p className="font-semibold">{example.earn_per_gifted_tree} pts</p>
          </div>
          <div className="border border-border p-3">
            <p className="text-xs text-muted">Redeem 1 tree</p>
            <p className="font-semibold">{example.redeem_one_tree} pts</p>
          </div>
          <div className="border border-border p-3">
            <p className="text-xs text-muted">Gifts → 1 free tree</p>
            <p className="font-semibold">
              ~{example.gifts_for_one_free_tree || data?.trees_until_free || 10}
            </p>
          </div>
        </div>
      ) : null}

      {getAuthToken() && redeemCost != null ? (
        <p className="mt-3 text-xs text-muted">
          {balance >= redeemCost
            ? `You can redeem a tree now (${redeemCost} pts).`
            : `Need ${(redeemCost - balance).toLocaleString()} more points for a free tree.`}
        </p>
      ) : null}
    </section>
  );
};

export default WaversPointsCard;
