"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Doc, type Id } from "@/convex/_generated/dataModel";
import { type UserStatus } from "@/convex/lib/validators";
import { getErrorMessage, formatDate } from "@/lib/utils";
import { USER_STATUS_BADGE, repColor } from "./shared";
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
  ShieldCheck,
  ShieldAlert,
  Ban,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

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

export function UserDetailDialog({
  user,
  onClose,
}: {
  user: Doc<"users"> | null;
  onClose: () => void;
}) {
  const updateStatus = useMutation(api.users.updateStatus);
  const updateRoles = useMutation(api.users.updateRoles);
  const [roleInput, setRoleInput] = useState("");
  const [localStatus, setLocalStatus] = useState<UserStatus>("active");

  useEffect(() => {
    if (user) {
      setRoleInput(user.roles.join(", "));
      setLocalStatus(user.status);
    }
  }, [user]);

  async function handleStatusChange(userId: Id<"users">, status: UserStatus) {
    try {
      await updateStatus({ userId, status });
      setLocalStatus(status);
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
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            {user?.name}
          </DialogTitle>
        </DialogHeader>

        {user && (
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p className="font-medium">{user.phone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Reputation</span>
                <p className={`font-bold ${repColor(user.reputationScore)}`}>
                  {user.reputationScore}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Books Read</span>
                <p className="font-medium">{user.booksRead}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Books Shared</span>
                <p className="font-medium">{user.booksShared}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p>
                  <Badge variant={USER_STATUS_BADGE[localStatus]}>
                    {localStatus}
                  </Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Joined</span>
                <p className="font-medium">
                  {formatDate(user._creationTime)}
                </p>
              </div>
            </div>

            {user.bio && (
              <div className="text-sm">
                <span className="text-muted-foreground">Bio</span>
                <p>{user.bio}</p>
              </div>
            )}

            {user.favoriteGenres.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">
                  Favorite Genres
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {user.favoriteGenres.map((g) => (
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
                    variant={localStatus === status ? activeVariant : "outline"}
                    onClick={() => handleStatusChange(user._id, status)}
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
                    handleRolesUpdate(user._id, roles);
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
  );
}
