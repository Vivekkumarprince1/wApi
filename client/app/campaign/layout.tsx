export default function CampaignLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="min-h-[calc(100vh-60px)] bg-background">
            <div className="max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8">
                {children}
            </div>
        </main>
    );
}
