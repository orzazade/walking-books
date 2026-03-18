"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Package,
  Search,
  Printer,
  BookOpen,
  Filter,
} from "lucide-react";
import Link from "next/link";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "checked_out", label: "Checked Out" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
  { value: "recalled", label: "Recalled" },
] as const;

const CONDITION_COLORS: Record<string, string> = {
  like_new: "bg-green-100 text-green-700",
  good: "bg-blue-100 text-blue-700",
  fair: "bg-yellow-100 text-yellow-700",
  worn: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  reserved: "secondary",
  checked_out: "outline",
  damaged: "destructive",
  lost: "destructive",
  recalled: "secondary",
};

export default function PartnerInventoryPage() {
  const location = useQuery(api.partnerLocations.myLocation);
  const allCopies = useQuery(
    api.copies.allAtLocation,
    location ? { locationId: location._id } : "skip",
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredCopies = useMemo(() => {
    if (!allCopies) return [];
    return allCopies.filter((copy) => {
      if (statusFilter !== "all" && copy.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !copy._id.toLowerCase().includes(term) &&
          !copy.condition.toLowerCase().includes(term) &&
          !copy.status.toLowerCase().includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allCopies, searchTerm, statusFilter]);

  if (location === undefined || allCopies === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (location === null) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No partner location found for your account.
        </CardContent>
      </Card>
    );
  }

  const statusCounts = allCopies.reduce(
    (acc, copy) => {
      acc[copy.status] = (acc[copy.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="mt-1 text-muted-foreground">
          {allCopies.length} copies at {location.name}
        </p>
      </div>

      {/* Summary row */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.filter((f) => f.value === "all" || statusCounts[f.value]).map(
          (f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                statusFilter === f.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted text-muted-foreground hover:border-muted-foreground/50"
              }`}
            >
              {f.label}
              {f.value !== "all" && statusCounts[f.value] && (
                <span className="ml-1 text-xs">({statusCounts[f.value]})</span>
              )}
              {f.value === "all" && (
                <span className="ml-1 text-xs">({allCopies.length})</span>
              )}
            </button>
          ),
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by copy ID, condition..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inventory table */}
      {filteredCopies.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {searchTerm || statusFilter !== "all"
              ? "No copies match your filters."
              : "No copies at this location."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="hidden grid-cols-5 gap-4 px-4 py-2 text-xs font-medium uppercase text-muted-foreground sm:grid">
            <span>Copy ID</span>
            <span>Status</span>
            <span>Condition</span>
            <span>Type</span>
            <span className="text-right">Actions</span>
          </div>

          {filteredCopies.map((copy) => {
            const daysOnShelf =
              copy.status === "available"
                ? Math.floor(
                    (Date.now() - copy._creationTime) / (1000 * 60 * 60 * 24),
                  )
                : null;

            return (
              <Card key={copy._id}>
                <CardContent className="grid grid-cols-1 items-center gap-2 p-4 sm:grid-cols-5 sm:gap-4">
                  <div>
                    <Link
                      href={`/copy/${copy._id}`}
                      className="font-medium hover:underline"
                    >
                      #{copy._id.slice(-6)}
                    </Link>
                    {daysOnShelf !== null && (
                      <p className="text-xs text-muted-foreground">
                        {daysOnShelf}d on shelf
                      </p>
                    )}
                  </div>
                  <div>
                    <Badge
                      variant={STATUS_COLORS[copy.status] || "outline"}
                      className="capitalize"
                    >
                      {copy.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CONDITION_COLORS[copy.condition] || ""}`}
                    >
                      {copy.condition.replace("_", " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm capitalize text-muted-foreground">
                      {copy.ownershipType}
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Link href="/partner/scan">
                      <Button variant="outline" size="sm" className="gap-1">
                        <BookOpen className="h-3 w-3" /> Scan
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.print()}
                    >
                      <Printer className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
