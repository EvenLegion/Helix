export default function NewsletterPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-var(--header-height))] w-full p-4">
            <iframe
                src="https://www.evenlegion.space/"
                className="w-full h-full border-0 rounded-lg"
                title="Even Legion Newsletter"
            />
        </div>
    );
}
