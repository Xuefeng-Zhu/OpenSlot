import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Toaster } from "../toaster";
import { useToast } from "../use-toast";

function ImmediateToast() {
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: "Calendar connected",
      description: "The OAuth result was received.",
    });
  }, [toast]);

  return null;
}

describe("Toaster", () => {
  it("renders a toast emitted before the viewport subscription mounts", async () => {
    render(
      <>
        <ImmediateToast />
        <Toaster />
      </>
    );

    expect(await screen.findByText("Calendar connected")).toBeTruthy();
    expect(screen.getByText("The OAuth result was received.")).toBeTruthy();
  });
});
