import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="space-y-5">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}
