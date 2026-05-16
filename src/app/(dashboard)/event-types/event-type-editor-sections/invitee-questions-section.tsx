import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  INVITEE_QUESTION_LIMIT,
  type InviteeQuestion,
  type InviteeQuestionType,
} from "@/lib/validations/invitee-questions";

interface InviteeQuestionsSectionProps {
  questions: InviteeQuestion[];
  error?: string;
  onAddQuestion: () => void;
  onRemoveQuestion: (questionId: string) => void;
  onUpdateQuestion: (
    questionId: string,
    patch: Partial<InviteeQuestion>
  ) => void;
  onUpdateQuestionType: (
    questionId: string,
    type: InviteeQuestionType
  ) => void;
  onUpdateQuestionOptions: (questionId: string, value: string) => void;
}

export function InviteeQuestionsSection({
  questions,
  error,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onUpdateQuestionType,
  onUpdateQuestionOptions,
}: InviteeQuestionsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Booking questions</p>
          <p className="text-xs text-muted-foreground">
            {questions.length}/{INVITEE_QUESTION_LIMIT} configured
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddQuestion}
          disabled={questions.length >= INVITEE_QUESTION_LIMIT}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          No custom questions yet.
        </div>
      ) : null}

      {questions.map((question, index) => (
        <div
          key={question.id}
          className="space-y-4 rounded-md border border-border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Question {index + 1}</p>
              <p className="text-xs text-muted-foreground">
                {question.required ? "Required" : "Optional"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove question ${index + 1}`}
              onClick={() => onRemoveQuestion(question.id)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div>
            <Label htmlFor={`question-label-${question.id}`}>
              Question label
            </Label>
            <Input
              id={`question-label-${question.id}`}
              value={question.label}
              onChange={(event) =>
                onUpdateQuestion(question.id, {
                  label: event.target.value,
                })
              }
              placeholder="e.g. What would you like to discuss?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`question-type-${question.id}`}>
                Answer type
              </Label>
              <Select
                value={question.type}
                onValueChange={(value) =>
                  onUpdateQuestionType(
                    question.id,
                    value as InviteeQuestionType
                  )
                }
              >
                <SelectTrigger
                  id={`question-type-${question.id}`}
                  className="h-11 border-border bg-background shadow-sm"
                >
                  <SelectValue placeholder="Select answer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Short text</SelectItem>
                  <SelectItem value="textarea">Long text</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex h-10 items-center justify-between gap-3 sm:mt-6">
              <Label htmlFor={`question-required-${question.id}`}>
                Required
              </Label>
              <Switch
                id={`question-required-${question.id}`}
                checked={question.required}
                onCheckedChange={(required) =>
                  onUpdateQuestion(question.id, { required })
                }
                aria-label={`Question ${index + 1} required`}
              />
            </div>
          </div>

          {question.type === "select" ? (
            <div>
              <Label htmlFor={`question-options-${question.id}`}>
                Options
              </Label>
              <Textarea
                id={`question-options-${question.id}`}
                value={question.options.join("\n")}
                onChange={(event) =>
                  onUpdateQuestionOptions(question.id, event.target.value)
                }
                rows={3}
              />
            </div>
          ) : null}
        </div>
      ))}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
