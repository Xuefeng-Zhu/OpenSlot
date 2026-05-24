"use client";

import {
  Copy,
  ExternalLink,
  Pencil,
  MoreVertical,
  Trash2,
  Clock,
  MapPin,
  Link2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface EventTypeCardProps {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  locationType: string;
  slug: string;
  isActive: boolean;
  bookingUrl: string;
  onCopyLink: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const iconColors = [
  "bg-accent text-primary",
  "bg-purple-50 text-purple-600",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
];

function getIconColorIndex(id: string) {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index)) % iconColors.length;
  }

  return hash;
}

export function EventTypeCard({
  id,
  title,
  description,
  durationMinutes,
  locationType,
  slug,
  isActive,
  onCopyLink,
  onPreview,
  onEdit,
  onDelete,
}: EventTypeCardProps) {
  const iconColor = iconColors[getIconColorIndex(id)];

  return (
    <Card className="p-4 transition-colors hover:border-primary/35 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Icon */}
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
            iconColor
          )}
        >
          <Clock className="h-5 w-5" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              {description && (
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                  {description}
                </p>
              )}
            </div>
            <Badge
              variant={isActive ? "success" : "warning"}
              className="w-fit shrink-0"
            >
              <span
                className={cn(
                  "mr-1.5 h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-success-foreground" : "bg-warning-foreground"
                )}
                aria-hidden="true"
              />
              {isActive ? "Active" : "Paused"}
            </Badge>
          </div>

          {/* Meta info */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {durationMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {locationType}
            </span>
            <span className="flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              /{slug}
            </span>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyLink}
              className="h-8"
              aria-label={`Copy booking link for ${title}`}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Copy link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onPreview}
              className="h-8"
              aria-label={`Preview ${title}`}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="h-8"
              aria-label={`Edit ${title}`}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`More options for ${title}`}
                >
                  <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </Card>
  );
}
