"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Doc, type Id } from "@/convex/_generated/dataModel";
import { type UserStatus } from "@/convex/lib/validators";
import { getErrorMessage } from "@/lib/utils";
import { USER_STATUS_BADGE, repColor } from "./shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserDetailDialog } from "./user-detail-dialog";
import {
  Search,
  ShieldAlert,
  Ban,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

const TABLE_STATUS_ACTIONS: Array<{ status: UserStatus; icon: typeof RotateCcw; title: string }> = [
  { status: "active", icon: RotateCcw, title: "Restore" },
  { status: "restricted", icon: ShieldAlert, title: "Restrict" },
  { status: "banned", icon: Ban, title: "Ban" },
];

export default function AdminUsersPage() {
  const allUsers = useQuery(api.users.listAll);
  const updateStatus = useMutation(api.users.updateStatus);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<Doc<"users"> | null>(null);

  if (allUsers === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const filtered = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone.includes(searchTerm),
  );


  async function handleStatusChange(
    userId: Id<"users">,
    status: "active" | "restricted" | "banned",
  ) {
    try {
      await updateStatus({ userId, status });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update user status"));
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="mt-1 text-muted-foreground">
          {allUsers.length} total users
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* User table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium text-center">
                    Reputation
                  </th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium text-center">
                    Read / Shared
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.phone}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-bold ${repColor(user.reputationScore)}`}
                    >
                      {user.reputationScore}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={USER_STATUS_BADGE[user.status]}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.booksRead} / {user.booksShared}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {TABLE_STATUS_ACTIONS.filter((a) => a.status !== user.status).map(({ status, icon: Icon, title }) => (
                          <Button
                            key={status}
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(user._id, status);
                            }}
                            title={title}
                          >
                            <Icon className="h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User detail modal */}
      <UserDetailDialog
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </>
  );
}
