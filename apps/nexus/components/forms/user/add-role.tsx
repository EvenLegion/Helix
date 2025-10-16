import { 
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeperator,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export function AddRoleForm () {
  return (
    <FieldSet>
      <FieldLegend>Add Role</FieldLegend>
      <FieldDescription>Add a role to a users profile</FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="role">Role</FieldLabel>
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Test</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>Select a role to add to the user</FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}
