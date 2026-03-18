"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Save,
  Loader2,
  MapPin,
  Clock,
  Users,
  Image,
  Plus,
  X,
} from "lucide-react";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function PartnerSettingsPage() {
  const location = useQuery(api.partnerLocations.myLocation);
  const updateLocation = useMutation(api.partnerLocations.update);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [shelfCapacity, setShelfCapacity] = useState(50);
  const [operatingHours, setOperatingHours] = useState<
    Record<string, { open: string; close: string; closed: boolean }>
  >({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [newStaffId, setNewStaffId] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location) {
      setName(location.name);
      setAddress(location.address);
      setContactPhone(location.contactPhone);
      setContactEmail(location.contactEmail ?? "");
      setShelfCapacity(location.shelfCapacity);
      setPhotos(location.photos);
      setStaffIds(location.staffUserIds as string[]);

      // Parse operating hours
      const hours = location.operatingHours || {};
      const parsed: Record<
        string,
        { open: string; close: string; closed: boolean }
      > = {};
      for (const day of DAYS_OF_WEEK) {
        if (hours[day]) {
          parsed[day] = {
            open: hours[day].open || "09:00",
            close: hours[day].close || "22:00",
            closed: hours[day].closed || false,
          };
        } else {
          parsed[day] = { open: "09:00", close: "22:00", closed: false };
        }
      }
      setOperatingHours(parsed);
    }
  }, [location]);

  if (location === undefined) {
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

  function updateHours(
    day: string,
    field: "open" | "close" | "closed",
    value: string | boolean,
  ) {
    setOperatingHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function addPhoto() {
    if (newPhotoUrl.trim()) {
      setPhotos((prev) => [...prev, newPhotoUrl.trim()]);
      setNewPhotoUrl("");
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function addStaff() {
    if (newStaffId.trim() && !staffIds.includes(newStaffId.trim())) {
      setStaffIds((prev) => [...prev, newStaffId.trim()]);
      setNewStaffId("");
    }
  }

  function removeStaff(index: number) {
    setStaffIds((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateLocation({
        locationId: location!._id,
        name: name.trim() || undefined,
        address: address.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        shelfCapacity,
        operatingHours,
        photos,
        staffUserIds: staffIds as any,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Location Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your partner location details
        </p>
      </div>

      <div className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Location Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Location Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cafe Nerd"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+994..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="cafe@example.com"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Shelf Capacity</label>
              <Input
                type="number"
                value={shelfCapacity}
                onChange={(e) =>
                  setShelfCapacity(parseInt(e.target.value) || 0)
                }
                min={1}
                max={1000}
              />
            </div>
          </CardContent>
        </Card>

        {/* Operating hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Operating Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium">{day}</span>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={!operatingHours[day]?.closed}
                    onChange={(e) =>
                      updateHours(day, "closed", !e.target.checked)
                    }
                    className="rounded"
                  />
                  Open
                </label>
                {!operatingHours[day]?.closed && (
                  <>
                    <Input
                      type="time"
                      value={operatingHours[day]?.open || "09:00"}
                      onChange={(e) =>
                        updateHours(day, "open", e.target.value)
                      }
                      className="w-28"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={operatingHours[day]?.close || "22:00"}
                      onChange={(e) =>
                        updateHours(day, "close", e.target.value)
                      }
                      className="w-28"
                    />
                  </>
                )}
                {operatingHours[day]?.closed && (
                  <span className="text-sm text-muted-foreground">Closed</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" /> Venue Photos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {photos.map((photo, i) => (
                  <div key={i} className="group relative">
                    <img
                      src={photo}
                      alt={`Venue photo ${i + 1}`}
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="https://... photo URL"
              />
              <Button
                variant="outline"
                onClick={addPhoto}
                disabled={!newPhotoUrl.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Staff management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Staff Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staffIds.length > 0 ? (
              <div className="space-y-2">
                {staffIds.map((id, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm font-mono">
                      {id.slice(0, 8)}...{id.slice(-4)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStaff(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No staff members added yet.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                value={newStaffId}
                onChange={(e) => setNewStaffId(e.target.value)}
                placeholder="User ID"
              />
              <Button
                variant="outline"
                onClick={addStaff}
                disabled={!newStaffId.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
          {saved && (
            <span className="text-sm text-green-600">Changes saved!</span>
          )}
        </div>
      </div>
    </>
  );
}
