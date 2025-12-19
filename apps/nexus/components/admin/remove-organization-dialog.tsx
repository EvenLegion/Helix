"use client"

import { useState } from "react";
// import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Button } from '@workspace/ui/components/button';
import {
    Select,
    SelectTrigger,
} from "@workspace/ui/components/select";

export function RemoveOrganizationDialog() {
    const [open, setOpen] = useState(false);
    // const router = useRouter();

    // const handleSuccess = () => {
    //     setOpen(false);
    //     router.refresh();
    // };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="destructive" className="m-1 p-2" />}>
                Remove Organization
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Remove Organization</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to remove this organization? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <Select>
                    <SelectTrigger className="w-full">

                    </SelectTrigger>
                </Select>
            </DialogContent>
        </Dialog>
    )
}