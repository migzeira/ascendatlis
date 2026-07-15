import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ascend" },
      { name: "description", content: "Ascend" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <h1 className="text-white text-6xl font-bold tracking-widest">ascend</h1>
    </div>
  );
}
