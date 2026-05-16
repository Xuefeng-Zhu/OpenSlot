import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { EventTypeSectionProps } from "./event-type-section-types";

export function BasicsSection({
  values,
  errors,
  onFieldChange,
  clearFieldError,
}: EventTypeSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(event) => {
            onFieldChange("title", event.target.value);
            if (event.target.value.trim()) {
              clearFieldError("title");
            }
          }}
          placeholder="e.g. 30-min Discovery Call"
        />
        {errors.title ? (
          <p className="text-xs text-destructive mt-1">{errors.title}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="slug">URL Slug</Label>
        <Input
          id="slug"
          value={values.slug}
          onChange={(event) => {
            onFieldChange("slug", event.target.value);
            if (event.target.value.trim()) {
              clearFieldError("slug");
            }
          }}
          placeholder="e.g. discovery-call"
        />
        {errors.slug ? (
          <p className="text-xs text-destructive mt-1">{errors.slug}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(event) => {
            onFieldChange("description", event.target.value);
            clearFieldError("description");
          }}
          placeholder="Describe what this meeting is about..."
          rows={3}
        />
        {errors.description ? (
          <p className="text-xs text-destructive mt-1">
            {errors.description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label htmlFor="is-active">Visible to guests</Label>
          <p className="text-xs text-muted-foreground">
            Paused event types stay editable but are hidden from public booking
            pages.
          </p>
        </div>
        <Switch
          id="is-active"
          checked={values.is_active}
          onCheckedChange={(checked) => onFieldChange("is_active", checked)}
          aria-label="Visible to guests"
        />
      </div>
    </div>
  );
}
