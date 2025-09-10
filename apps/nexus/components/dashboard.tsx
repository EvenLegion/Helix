import {
    Card,
    CardHeader,
    CardTitle
} from "@workspace/ui/components/card";

export function Dashboard() {
    return (
        <div className="min-h-svh p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Card Title</CardTitle>
                </CardHeader>
            </Card>
        </div>
    );
}
