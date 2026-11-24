import { IoCreateOutline, IoPeopleOutline, IoShareSocialOutline } from "react-icons/io5";
import ModernPostCreator from "../components/ModernPostCreator";
import PendingOfflinePosts from "../components/PendingOfflinePosts";
import Postcomponent from "../components/Postcomponent";

export default function PostsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5">
      <header className="relative overflow-hidden border border-border bg-surface p-5 sm:p-7">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Community updates</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Posts</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Share what you’re doing for people and the planet. Browse updates, join the conversation, and pass a post along.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1.5"><IoCreateOutline /> Create updates</span>
            <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1.5"><IoPeopleOutline /> Meet the community</span>
            <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1.5"><IoShareSocialOutline /> Share beyond Climate Wavers</span>
          </div>
        </div>
      </header>
      <div className="border border-border bg-surface p-3 sm:p-4">
        <ModernPostCreator type="post" />
      </div>
      <PendingOfflinePosts />
      <section aria-label="Community posts">
        <Postcomponent type="post" />
      </section>
    </main>
  );
}
