"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Doc, type Id } from "@/convex/_generated/dataModel";
import { type UserStatus } from "@/convex/lib/validators";
import { getErrorMessage, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  Ban,
  RotateCcw,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

const USER_STATUS_BADGE: Record<UserStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  restricted: "secondary",
  banned: "destructive",
};

const TABLE_STATUS_ACTIONS: Array<{ status: UserStatus; icon: typeof RotateCcw; title: string }> = [
  { status: "active", icon: RotateCcw, title: "Restore" },
  { status: "restricted", icon: ShieldAlert, title: "Restrict" },
  { status: "banned", icon: Ban, title: "Ban" },
];

const MODAL_STATUS_ACTIONS: Array<{
  status: UserStatus;
  icon: typeof ShieldCheck;
  label: string;
  activeVariant: "default" | "destructive";
}> = [
  { status: "active", icon: ShieldCheck, label: "Active", activeVariant: "default" },
  { status: "restricted", icon: ShieldAlert, label: "Restrict", activeVariant: "default" },
  { status: "banned", icon: Ban, label: "Ban", activeVariant: "destructive" },
];

function repColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 30) return "text-amber-600";
  return "text-destructive";
}

export default function AdminUsersPage() {
  const allUsers = useQuery(api.users.listAll);
  const updateStatus = useMutation(api.users.updateStatus);
  const updateRoles = useMutation(api.users.updateRoles);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<Doc<"users"> | null>(null);
  const [roleInput, setRoleInput] = useState("");

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

  async function handleRolesUpdate(userId: Id<"users">, roles: string[]) {
    try {
      await updateRoles({ userId, roles });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update user roles"));
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
                    onClick={() => {
                      setSelectedUser(user);
                      setRoleInput(user.roles.join(", "));
                    }}
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
      <Dialog
        open={selectedUser !== null}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-medium">{selectedUser.phone}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reputation</span>
                  <p
                    className={`font-bold ${repColor(selectedUser.reputationScore)}`}
                  >
                    {selectedUser.reputationScore}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Books Read</span>
                  <p className="font-medium">{selectedUser.booksRead}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Books Shared</span>
                  <p className="font-medium">{selectedUser.booksShared}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p>
                    <Badge variant={USER_STATUS_BADGE[selectedUser.status]}>
                      {selectedUser.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Joined</span>
                  <p className="font-medium">
                    {formatDate(selectedUser._creationTime)}
                  </p>
                </div>
              </div>

              {selectedUser.bio && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Bio</span>
                  <p>{selectedUser.bio}</p>
                </div>
              )}

              {selectedUser.favoriteGenres.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">
                    Favorite Genres
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedUser.favoriteGenres.map((g) => (
                      <Badge key={g} variant="secondary" className="text-xs">
                        {g}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Status actions */}
              <div>
                <p className="mb-2 text-sm font-medium">Change Status</p>
                <div className="flex gap-2">
                  {MODAL_STATUS_ACTIONS.map(({ status, icon: Icon, label, activeVariant }) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selectedUser.status === status ? activeVariant : "outline"}
                      onClick={() => {
                        handleStatusChange(selectedUser._id, status);
                        setSelectedUser({ ...selectedUser, status });
                      }}
                      className="gap-1"
                    >
                      <Icon className="h-3 w-3" /> {label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Role management */}
              <div>
                <p className="mb-2 text-sm font-medium">
                  Roles (comma-separated)
                </p>
                <div className="flex gap-2">
                  <Input
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    placeholder="reader, partner, admin"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const roles = roleInput
                        .split(",")
                        .map((r) => r.trim())
                        .filter(Boolean);
                      handleRolesUpdate(selectedUser._id, roles);
                      setSelectedUser({ ...selectedUser, roles });
                    }}
                  >
                    Save Roles
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
