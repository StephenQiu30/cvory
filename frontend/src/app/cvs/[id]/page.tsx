import { AccountProvider } from "@/components/account/account-provider";
import CvEditor from "./_components/cv-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AccountProvider><CvEditor key={id} id={id} /></AccountProvider>;
}
