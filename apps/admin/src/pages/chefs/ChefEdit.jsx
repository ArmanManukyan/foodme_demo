import {
    Edit,
    SimpleForm,
    TextInput,
    NumberInput,
    SelectInput,
} from 'react-admin';

const statusChoices = [
    { id: 'ACTIVE', name: 'ACTIVE' },
    { id: 'INACTIVE', name: 'INACTIVE' },
];

const ChefEdit = () => (
    <Edit>
        <SimpleForm>
            <TextInput source="username" fullWidth />
            <TextInput source="phoneNumber" label="Phone" fullWidth />
            <SelectInput source="status" choices={statusChoices} fullWidth />
            {/* Average of customer reviews (KAN-9); the backend ignores edits. */}
            <NumberInput source="rating" disabled helperText="Calculated from customer reviews" />
            <NumberInput source="deliveryPrice" label="Delivery price" />
            <NumberInput source="freeDeliveryFrom" label="Free delivery from" />
        </SimpleForm>
    </Edit>
);

export default ChefEdit;
