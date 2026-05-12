"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Mail,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import type { ContactSummary } from "@/lib/contacts/summaries";

type ContactFilter = "all" | "upcoming" | "past" | "cancelled";

interface ContactsClientProps {
  contacts: ContactSummary[];
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "No meetings";

  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function contactMatchesSearch(contact: ContactSummary, search: string): boolean {
  const query = search.trim().toLowerCase();

  if (!query) return true;

  return [
    contact.displayName,
    contact.displayEmail,
    contact.lastGuestTimezone ?? "",
    ...contact.eventTitles,
  ].some((value) => value.toLowerCase().includes(query));
}

function contactMatchesFilter(contact: ContactSummary, filter: ContactFilter): boolean {
  if (filter === "upcoming") return contact.upcomingCount > 0;
  if (filter === "past") return contact.pastCount > 0 || contact.rescheduledCount > 0;
  if (filter === "cancelled") return contact.cancelledCount > 0;
  return true;
}

export function ContactsClient({ contacts }: ContactsClientProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("all");

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contactMatchesSearch(contact, search) &&
          contactMatchesFilter(contact, filter)
      ),
    [contacts, filter, search]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground">
          Review repeat guests and their meeting history.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-md">
          <Label
            htmlFor="contact-search"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Search contacts
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="contact-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, event type..."
              className="pl-9 pr-10"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear contact search"
                className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as ContactFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredContacts.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-6 w-6" />}
          heading={contacts.length === 0 ? "No contacts yet" : "No contacts found"}
          description={
            contacts.length === 0
              ? "Contacts appear after guests book time with you."
              : "Adjust the search or status filter."
          }
        />
      ) : (
        <ContactsTable contacts={filteredContacts} />
      )}
    </div>
  );
}

function ContactsTable({ contacts }: { contacts: ContactSummary[] }) {
  return (
    <>
      <div className="hidden lg:block">
        <div className="rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-3 text-left font-medium text-muted-foreground">
                  Contact
                </th>
                <th className="p-3 text-left font-medium text-muted-foreground">
                  Meetings
                </th>
                <th className="p-3 text-left font-medium text-muted-foreground">
                  Last meeting
                </th>
                <th className="p-3 text-left font-medium text-muted-foreground">
                  Next meeting
                </th>
                <th className="p-3 text-left font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <span className="text-sm font-medium">
                          {contact.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{contact.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.displayEmail}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{contact.totalBookings} total</Badge>
                      {contact.upcomingCount > 0 && (
                        <Badge variant="success">{contact.upcomingCount} upcoming</Badge>
                      )}
                      {contact.cancelledCount > 0 && (
                        <Badge variant="danger">{contact.cancelledCount} cancelled</Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">{formatDate(contact.lastMeetingAt)}</td>
                  <td className="p-3">{formatDate(contact.nextMeetingAt)}</td>
                  <td className="p-3">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/contacts/${contact.id}`}>
                        View
                        <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {contacts.map((contact) => (
          <Card key={contact.id} className="transition-colors hover:border-primary/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{contact.displayName}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {contact.displayEmail}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {contact.totalBookings} meetings
                  </p>
                </div>
                <Button asChild variant="ghost" size="icon" aria-label={`View ${contact.displayName}`}>
                  <Link href={`/contacts/${contact.id}`}>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
