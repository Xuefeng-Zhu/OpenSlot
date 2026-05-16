import {
  Bell,
  CalendarDays,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
} from "lucide-react";
import type { FormSection } from "./event-type-section-types";

export const FORM_SECTIONS: readonly FormSection[] = [
  {
    id: "basics",
    title: "Basics",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "duration",
    title: "Duration & Buffers",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: "location",
    title: "Location",
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    id: "scheduling",
    title: "Scheduling Limits",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    id: "reminders",
    title: "Reminders",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: "questions",
    title: "Invitee Questions",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    id: "confirmation",
    title: "Confirmation",
    icon: <CheckCircle className="h-4 w-4" />,
  },
];

export type { FormSectionId } from "./event-type-section-types";
