"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type Condition, type OwnershipType, CONDITION_LABELS } from "@/convex/lib/validators";
import { IsbnScanner } from "@/components/isbn-scanner";
import { getErrorMessage } from "@/lib/utils";
import { ConditionPhotoCapture } from "@/components/condition-photo-capture";
import { LocationPicker } from "@/components/location-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";


const CONDITIONS: { value: Condition; label: string; desc: string }[] = [
  { value: "like_new", label: "Like New", desc: "No visible wear" },
  { value: "good", label: "Good", desc: "Minor signs of use" },
  { value: "fair", label: "Fair", desc: "Moderate wear" },
  { value: "worn", label: "Worn", desc: "Heavy use, still readable" },
];

export default function ShareBookPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    copyId: string;
    bookId: string;
  } | null>(null);

  // Step 1: Book info
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [language, setLanguage] = useState("English");
  const [coverImage, setCoverImage] = useState("");
  const [publisher, setPublisher] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  // Step 2: Ownership
  const [ownershipType, setOwnershipType] = useState<OwnershipType>("donated");
  const [maxLendingDays, setMaxLendingDays] = useState("");

  // Step 3: Condition
  const [condition, setCondition] = useState<Condition>("good");
  const [photos, setPhotos] = useState<string[]>([]);

  // Step 4: Location
  const [locationId, setLocationId] = useState<string>();

  const lookupISBN = useAction(api.books.lookupISBN);
  const register = useMutation(api.books.register);

  async function handleIsbnScan(scannedIsbn: string) {
    setIsbn(scannedIsbn);
    setLookingUp(true);
    try {
      const result = await lookupISBN({ isbn: scannedIsbn });
      if (result) {
        setTitle(result.title);
        setAuthor(result.author);
        setDescription(result.description);
        setCategories(result.categories.join(", "));
        setPageCount(result.pageCount ? String(result.pageCount) : "");
        setLanguage(result.language);
        setCoverImage(result.coverImage);
        setPublisher(result.publisher ?? "");
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to look up ISBN"));
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit() {
    if (!locationId) return;
    setSubmitting(true);
    try {
      const result = await register({
        title,
        author,
        isbn: isbn || undefined,
        coverImage: coverImage || "",
        description,
        categories: categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        pageCount: parseInt(pageCount) || 0,
        language,
        publisher: publisher || undefined,
        ownershipType,
        condition,
        locationId: locationId as Id<"partnerLocations">,
        sharerMaxLendingDays: maxLendingDays
          ? parseInt(maxLendingDays)
          : undefined,
      });
      setSuccess({
        copyId: result.copyId,
        bookId: result.bookId,
      });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to register book"));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold">Book Shared Successfully!</h2>
            <p className="text-muted-foreground">
              Your copy has been registered. Please drop it off at the selected
              location.
            </p>
            <p className="text-sm text-muted-foreground">
              Copy ID: {success.copyId.slice(-8)}
            </p>
            <Button onClick={() => (window.location.href = "/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return title.trim() && author.trim();
      case 2:
        return true;
      case 3:
        return !!condition;
      case 4:
        return !!locationId;
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Share a Book</h1>
        <p className="mt-1 text-muted-foreground">
          Step {step} of 5 &mdash;{" "}
          {
            [
              "",
              "Book Details",
              "Ownership",
              "Condition",
              "Drop-off Location",
              "Review & Confirm",
            ][step]
          }
        </p>
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Book Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Book Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!title && !lookingUp && (
              <IsbnScanner onScan={handleIsbnScan} />
            )}
            {lookingUp && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Looking up
                ISBN...
              </div>
            )}
            {(title || isbn) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Title *</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Author *</label>
                    <Input
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Page Count</label>
                      <Input
                        type="number"
                        value={pageCount}
                        onChange={(e) => setPageCount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Language</label>
                      <Input
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Categories (comma separated)
                    </label>
                    <Input
                      value={categories}
                      onChange={(e) => setCategories(e.target.value)}
                      placeholder="Fiction, Classic, ..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Cover Image URL
                    </label>
                    <Input
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            {!title && !isbn && !lookingUp && (
              <>
                <Separator />
                <Button
                  variant="link"
                  onClick={() => setIsbn("manual")}
                >
                  Skip ISBN lookup, enter details manually
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Ownership */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Ownership Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(["donated", "lent"] as OwnershipType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setOwnershipType(type)}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${
                    ownershipType === type
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <p className="font-semibold capitalize">{type}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {type === "donated"
                      ? "Give this book to the community permanently"
                      : "Lend this book and get it back later"}
                  </p>
                </button>
              ))}
            </div>
            {ownershipType === "lent" && (
              <div>
                <label className="text-sm font-medium">
                  Max lending period (days, optional)
                </label>
                <Input
                  type="number"
                  value={maxLendingDays}
                  onChange={(e) => setMaxLendingDays(e.target.value)}
                  placeholder="Default: based on page count"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Condition */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Book Condition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCondition(c.value)}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    condition === c.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <p className="font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </button>
              ))}
            </div>
            <Separator />
            <div>
              <p className="mb-2 text-sm font-medium">
                Condition Photo (optional)
              </p>
              <ConditionPhotoCapture
                photos={photos}
                onCapture={(url) => setPhotos([...photos, url])}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Location */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Drop-off Location</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationPicker
              selectedId={locationId}
              onSelect={setLocationId}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title</span>
                <span className="font-medium">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author</span>
                <span>{author}</span>
              </div>
              {isbn && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ISBN</span>
                  <span>{isbn}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ownership</span>
                <Badge variant="secondary" className="capitalize">
                  {ownershipType}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Condition</span>
                <Badge variant="secondary">
                  {CONDITION_LABELS[condition]}
                </Badge>
              </div>
              {photos.length > 0 && (
                <div className="flex gap-2 pt-1">
                  {photos.map((p, i) => (
                    <div
                      key={i}
                      className="h-12 w-12 overflow-hidden rounded bg-muted"
                    >
                      <img
                        src={p}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        ) : (
          <div />
        )}
        {step < 5 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
            Next <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Sharing...
              </>
            ) : (
              <>
                <Check className="mr-1 h-4 w-4" /> Share Book
              </>
            )}
          </Button>
        )}
      </div>
    </main>
  );
}
