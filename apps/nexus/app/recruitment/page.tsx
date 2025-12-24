"use client";

import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";

// TODO: Create recruitment page
export default function Recruitment() {
    const router = useRouter();

    return (
        <div>
            <h1>Recruitment</h1>
            <Button onClick={() => router.push('/recruitment/application')}>
                Apply Now
            </Button>
        </div>
    )
}
