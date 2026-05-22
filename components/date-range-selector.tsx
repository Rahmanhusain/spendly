"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type DateMode = "monthly" | "all-time" | "custom";

export function DateRangeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const monthStart = useMemo(
    () =>
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split("T")[0],
    [],
  );
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const modeFromUrl = searchParams.get("dateRange") as DateMode | null;
  const modeFromRoute: DateMode =
    modeFromUrl === "all-time" || modeFromUrl === "custom"
      ? modeFromUrl
      : "monthly";

  const [selectedMode, setSelectedMode] = useState<DateMode>(modeFromRoute);

  const [startDate, setStartDate] = useState<string>(
    searchParams.get("startDate") ?? monthStart,
  );
  const [endDate, setEndDate] = useState<string>(
    searchParams.get("endDate") ?? today,
  );
  const mode = isPending ? selectedMode : modeFromRoute;

  const handleModeChange = useCallback(
    (newMode: DateMode) => {
      setSelectedMode(newMode);

      const params = new URLSearchParams(searchParams.toString());
      params.set("dateRange", newMode);
      if (newMode !== "custom") {
        params.delete("startDate");
        params.delete("endDate");
      }

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams, startTransition],
  );

  const handleCustomApply = useCallback(() => {
    if (startDate && endDate) {
      setSelectedMode("custom");

      const params = new URLSearchParams(searchParams.toString());
      params.set("dateRange", "custom");
      params.set("startDate", startDate);
      params.set("endDate", endDate);

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }
  }, [endDate, pathname, router, searchParams, startDate, startTransition]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === "monthly" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("monthly")}
          disabled={isPending}
        >
          {isPending && mode === "monthly" && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          This Month
        </Button>

        <Button
          variant={mode === "all-time" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("all-time")}
          disabled={isPending}
        >
          {isPending && mode === "all-time" && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          All-time
        </Button>

        <Button
          variant={mode === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("custom")}
          disabled={isPending}
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
              disabled={isPending || !startDate || !endDate}
              size="sm"
              className="w-full sm:w-auto"
            >
              {isPending ? (
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
