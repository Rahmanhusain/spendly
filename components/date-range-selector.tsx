"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type DateMode = "monthly" | "all-time" | "custom";

export function DateRangeSelector() {
  const router = useRouter();
  const [mode, setMode] = useState<DateMode>("monthly");
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);

  const handleModeChange = useCallback(
    (newMode: DateMode) => {
      setMode(newMode);
      setLoading(true);

      const params = new URLSearchParams();
      params.set("dateRange", newMode);

      setTimeout(() => {
        router.push(`?${params.toString()}`);
        setLoading(false);
      }, 200);
    },
    [router],
  );

  const handleCustomApply = useCallback(() => {
    if (startDate && endDate) {
      setLoading(true);

      const params = new URLSearchParams();
      params.set("dateRange", "custom");
      params.set("startDate", startDate);
      params.set("endDate", endDate);

      setTimeout(() => {
        router.push(`?${params.toString()}`);
        setLoading(false);
      }, 200);
    }
  }, [startDate, endDate, router]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === "monthly" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("monthly")}
          disabled={loading}
        >
          {loading && mode === "monthly" && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          This Month
        </Button>

        <Button
          variant={mode === "all-time" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("all-time")}
          disabled={loading}
        >
          {loading && mode === "all-time" && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          All-time
        </Button>

        <Button
          variant={mode === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("custom")}
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          Custom
        </Button>
      </div>

      {mode === "custom" && (
        <Card className="p-3 bg-slate-50">
          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                size={1}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                size={1}
              />
            </div>
            <Button
              onClick={handleCustomApply}
              disabled={loading || !startDate || !endDate}
              size="sm"
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
