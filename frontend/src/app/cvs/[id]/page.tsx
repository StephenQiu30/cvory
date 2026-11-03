import CvEditor from "./_components/cv-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CvEditor key={id} id={id} />;
}
