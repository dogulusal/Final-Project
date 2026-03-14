import AISummaryModal from "@/features/ai-analysis/ui/AISummaryModal";

export default async function InterceptedNewsModal({ params }: { params: Promise<{ slug: string }> }) {
    // Next 15 awaits params by default
    const resolvedParams = await params;
    
    return <AISummaryModal newsId={resolvedParams.slug} />;
}
