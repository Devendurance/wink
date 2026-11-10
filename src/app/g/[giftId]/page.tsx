import type { Metadata } from "next";
import { Suspense } from "react";
import { GiftPage } from "@/components/GiftView";

export const metadata: Metadata = {
  title: "A gift for you",
  description: "Someone sent you a gift on Wink. Open it and claim it with your wallet.",
};

export default function GiftRoute({ params }: PageProps<"/g/[giftId]">) {
  return (
    <Suspense fallback={<div className="panel" style={{ maxWidth: 560, margin: "64px auto", textAlign: "center" }}>Loading your gift...</div>}>
      {params.then(({ giftId }) => (
        <GiftPage giftId={giftId} />
      ))}
    </Suspense>
  );
}
