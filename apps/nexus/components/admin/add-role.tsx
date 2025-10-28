import { Badge } from '@workspace/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { AddRoleForm } from '@/components/forms/user/add-role';

export function AddRole() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Badge variant="secondary" className="text-xs cursor-pointer">
          +
        </Badge>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogTitle>Add roles</DialogTitle>
        <AddRoleForm />
      </DialogContent>
    </Dialog>
  );
}
