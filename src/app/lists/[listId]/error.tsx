"use client";

// BUG (BUGS.md #12 client-side error boundary swallows errors): this is a
// Next.js error boundary for the /lists/[listId] route segment. It renders a
// generic "Something went wrong" screen for any thrown error (e.g. editing a
// task into a broken UI state) but never logs or reports the error anywhere
// -- no console.error, no call to a reporting endpoint. The error and its
// stack are simply discarded, so nothing about it ever reaches the server
// logs Fluent Bit tails.
export default function ListDetailError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold leading-8 text-primary">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm leading-5 text-secondary">
        Please try again later.
      </p>
    </div>
  );
}
