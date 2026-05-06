"use client";

import * as React from "react";
import {
  BarChart3,
  Clock3,
  Copy,
  Eye,
  Link2,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";

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

const iconBySlug = [
  { match: "strategy", icon: Users, className: "bg-violet-50 text-violet-600" },
  { match: "office", icon: BarChart3, className: "bg-emerald-50 text-emerald-600" },
];

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
  const iconConfig =
    iconBySlug.find((item) => slug.includes(item.match)) ?? {
      icon: Clock3,
      className: "bg-primary/10 text-primary",
    };
  const Icon = iconConfig.icon;

  return (
    <Card className="bg-white p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-5">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] ${iconConfig.className}`}
            aria-hidden="true"
          >
            <Icon className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-extrabold text-foreground">{title}</h3>
              <Badge variant={isActive ? "success" : "warning"} className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-current" />
                {isActive ? "Active" : "Paused"}
              </Badge>
            </div>
            {description && (
              <p className="mt-2 max-w-[560px] text-sm font-medium leading-6 text-muted-foreground">
                {description}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-6 text-sm font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                {durationMinutes} min
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {locationType}
              </span>
              <span className="inline-flex items-center gap-2">
                <Link2 className="h-4 w-4" aria-hidden="true" />/{slug}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <Button variant="outline" size="sm" onClick={onCopyLink}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            Copy link
          </Button>
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More options">
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
