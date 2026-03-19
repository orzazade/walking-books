import {
  BookOpen,
  BookCheck,
  Share2,
  Users,
  Star,
  PenLine,
  MapPin,
  Compass,
  Library,
  Target,
  Trophy,
} from "lucide-react";

export const ACHIEVEMENT_ICONS: Record<string, typeof BookOpen> = {
  first_read: BookOpen,
  books_read_5: BookCheck,
  books_read_25: Library,
  books_shared_1: Share2,
  books_shared_5: Users,
  first_review: PenLine,
  reviews_10: Star,
  genres_3: Compass,
  genres_5: Compass,
  locations_3: MapPin,
  first_follow: Users,
  goal_completed: Target,
  collection_created: Library,
};

/** Fallback icon for unknown achievement keys. */
export const ACHIEVEMENT_FALLBACK_ICON = Trophy;
