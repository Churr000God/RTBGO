import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabase } from "../lib/supabaseClient";
import { VerificarTotpPage } from "./VerificarTotpPage";

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      mfa: {
        challenge: vi.fn().mockResolvedValue({ data: { id: "challenge-1" }, error: null }),
        verify: vi.fn(),
      },
    },
  },
}));

describe("VerificarTotpPage", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.mfa.verify).mockReset();
  });

  it("navega tras un código correcto", async () => {
    vi.mocked(supabase.auth.mfa.verify).mockResolvedValue({
      data: { access_token: "tok" },
      error: null,
    } as never);

    render(<VerificarTotpPage factorId="factor-1" />);
    await userEvent.type(screen.getByLabelText(/código/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() =>
      expect(supabase.auth.mfa.verify).toHaveBeenCalledWith({
        factorId: "factor-1",
        challengeId: "challenge-1",
        code: "123456",
      })
    );
  });
});
