import { redirect } from "next/navigation";

// No landing page: the API is the product. The root points at the API index.
export default function Home() {
  redirect("/api/v1");
}
