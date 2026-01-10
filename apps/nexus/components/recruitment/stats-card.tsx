import { Card, CardHeader, CardTitle, CardContent } from '@workspace/ui/components/card';

interface StatsCardProps {
    title: string;
    value: number;
    description?: string;
}

export function StatsCard({ title, value, description }: StatsCardProps) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
            </CardContent>
        </Card>
    );
}
