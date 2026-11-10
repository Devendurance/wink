import type { Metadata } from "next";
import { SentGifts } from "@/components/SentGifts";

export const metadata: Metadata = {
  title: "Gifts you sent",
  description: "Gifts funded from your wallet, read from the Wink vault.",
};

export default function SentPage() {
  return <SentGifts />;
}
