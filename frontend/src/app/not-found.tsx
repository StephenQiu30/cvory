import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-xl font-medium">找不到这个页面</h1>
      <Link className="mt-5 inline-block text-link" href="/">
        返回我的简历
      </Link>
    </main>
  );
}
