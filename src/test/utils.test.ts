import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("utils", () => {
    describe("cn", () => {
        it("should merge class names correctly", () => {
             const result = cn("text-red-500", "bg-blue-500");
             expect(result).toContain("text-red-500");
             expect(result).toContain("bg-blue-500");
        });

        it("should handle conditional classes", () => {
            const result = cn("text-red-500", false && "bg-blue-500", "p-4");
            expect(result).toBe("text-red-500 p-4");
        });

        it("should resolve tailwind conflicts (twMerge)", () => {
            // twMerge should keep the last conflicting class (p-4 overrides p-2)
            const result = cn("p-2", "p-4");
            expect(result).toBe("p-4");
        });
    });
});
