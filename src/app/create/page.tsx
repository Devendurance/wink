import type { Metadata } from "next";
import { CreateGift } from "@/components/CreateGift";

export const metadata: Metadata = {
  title: "Create a gift",
  description: "Fund a BOT gift, write a note and share the link.",
};

export default function CreatePage() {
  return <CreateGift />;
}
