import type { Metadata } from "next";
import { Join } from "@/components/join/Join";
import "./join.css";

export const metadata: Metadata = { title: "Manor 09 · The parlour" };

export default function JoinPage() {
  return <Join />;
}
