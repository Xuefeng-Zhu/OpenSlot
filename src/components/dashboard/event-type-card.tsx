"use client";

import * as React from "react";
import {
  Copy,
  ExternalLink,
  Pencil,
  MoreHorizontal,
  Trash2,
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

export function EventTypeCard({
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
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        {/* Header: title + status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <Badge variant={isActive ? "success" : "secondary"}>
            {isActive ? "Active" : "Draft"}
          </Badge>
        </div>

        {/* Description (truncated to 2 lines) */}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        {/* Meta: duration, location, slug */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{durationMinutes} min</Badge>
          <span className="text-sm text-muted-foreground">{locationType}</span>
          <span className="text-xs text-muted-foreground">/{slug}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyLink}
            aria-label="Copy link"
          >
            <Copy className="h-4 w-4 mr-1" aria-hidden="true" />
            Copy link
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreview}
            aria-label="Preview"
          >
            <ExternalLink className="h-4 w-4 mr-1" aria-hidden="true" />
            Preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4 mr-1" aria-hidden="true" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
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
    </Card>
  );
}
