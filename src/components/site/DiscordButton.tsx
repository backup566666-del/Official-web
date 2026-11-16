import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DISCORD_INVITE_URL } from "@/lib/site-links";

export function DiscordButton({ children = "Join our Discord", ...props }: ButtonProps) {
  if (DISCORD_INVITE_URL) {
    return (
      <Button asChild variant="neon" size="xl" {...props}>
        <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      </Button>
    );
  }
  return (
    <Button
      variant="neon"
      size="xl"
      onClick={() =>
        toast("Discord invite coming soon", {
          description: "The official Free City Discord link will be added here shortly.",
        })
      }
      {...props}
    >
      {children}
    </Button>
  );
}
