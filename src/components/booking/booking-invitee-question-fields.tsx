"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  InviteeAnswerValue,
  InviteeQuestion,
} from "@/lib/validations/invitee-questions";

interface BookingInviteeQuestionFieldsProps {
  questions: InviteeQuestion[];
  answers: Record<string, unknown> | undefined;
  answerErrors: Record<string, { message?: string }> | undefined;
  onAnswerChange: (questionId: string, value: InviteeAnswerValue) => void;
}

export function BookingInviteeQuestionFields({
  questions,
  answers,
  answerErrors,
  onAnswerChange,
}: BookingInviteeQuestionFieldsProps) {
  return (
    <>
      {questions.map((question) => (
        <div key={question.id} className="space-y-2">
          {question.type !== "checkbox" && (
            <Label htmlFor={`answer-${question.id}`}>
              {question.label}
              {question.required ? " *" : ""}
            </Label>
          )}

          {question.type === "textarea" && (
            <Textarea
              id={`answer-${question.id}`}
              value={(answers?.[question.id] as string | undefined) ?? ""}
              onChange={(event) =>
                onAnswerChange(question.id, event.target.value)
              }
              aria-invalid={!!answerErrors?.[question.id]}
              aria-describedby={
                answerErrors?.[question.id]
                  ? `answer-${question.id}-error`
                  : undefined
              }
            />
          )}

          {question.type === "text" && (
            <Input
              id={`answer-${question.id}`}
              value={(answers?.[question.id] as string | undefined) ?? ""}
              onChange={(event) =>
                onAnswerChange(question.id, event.target.value)
              }
              aria-invalid={!!answerErrors?.[question.id]}
              aria-describedby={
                answerErrors?.[question.id]
                  ? `answer-${question.id}-error`
                  : undefined
              }
            />
          )}

          {question.type === "select" && (
            <Select
              value={(answers?.[question.id] as string | undefined) ?? ""}
              onValueChange={(value) => onAnswerChange(question.id, value)}
            >
              <SelectTrigger
                id={`answer-${question.id}`}
                aria-invalid={!!answerErrors?.[question.id]}
              >
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {question.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {question.type === "checkbox" && (
            <label
              htmlFor={`answer-${question.id}`}
              className="flex items-start gap-2 rounded-md border border-border p-3 text-sm"
            >
              <input
                id={`answer-${question.id}`}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={Boolean(answers?.[question.id])}
                onChange={(event) =>
                  onAnswerChange(question.id, event.target.checked)
                }
                aria-invalid={!!answerErrors?.[question.id]}
                aria-describedby={
                  answerErrors?.[question.id]
                    ? `answer-${question.id}-error`
                    : undefined
                }
              />
              <span>
                {question.label}
                {question.required ? " *" : ""}
              </span>
            </label>
          )}

          {answerErrors?.[question.id] && (
            <p
              id={`answer-${question.id}-error`}
              className="text-sm text-destructive"
            >
              {answerErrors[question.id].message}
            </p>
          )}
        </div>
      ))}
    </>
  );
}
