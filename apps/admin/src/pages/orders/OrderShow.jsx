import { useState } from 'react';
import { Show, useRecordContext, useRefresh, useNotify } from 'react-admin';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Stack,
    Rating,
} from '@mui/material';
import { OrderStatus, OrderStatusColors, OrderStatusTransitions } from '../../constants/OrderStatus.jsx';
import { updateOrderStatus } from '../../api/order-api.js';
import BackButton from '../../layout/BackButton.jsx';

// KAN-9 R20–R22: shown for delivered orders only.
const CustomerReview = ({ status, review }) => {
    if (status !== OrderStatus.DELIVERED) return null;
    return (
        <>
            <Divider sx={{ my: 2 }} />
            <Box data-testid="customer-review">
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Customer review
                </Typography>
                {review ? (
                    <>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Rating value={review.stars} readOnly aria-label={`${review.stars} out of 5 stars`} />
                            <Typography variant="body2" color="text.secondary">
                                {new Date(review.createdAt).toLocaleString()}
                            </Typography>
                        </Stack>
                        {review.comment && (
                            // Rendered as text, never as HTML: the comment is customer input.
                            <Typography sx={{ mt: 1, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                                {review.comment}
                            </Typography>
                        )}
                    </>
                ) : (
                    <Typography color="text.secondary">No review yet</Typography>
                )}
            </Box>
        </>
    );
};

const OrderDetails = () => {
    const record = useRecordContext();
    const refresh = useRefresh();
    const notify = useNotify();
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [loading, setLoading] = useState(false);

    if (!record) return null;

    const availableTransitions = OrderStatusTransitions[record.status] ?? [];

    const applyStatusChange = async (status, reason = null) => {
        setLoading(true);
        try {
            await updateOrderStatus(record.id, status, reason);
            notify('Order status updated', { type: 'success' });
            refresh();
        } catch {
            notify('Failed to update order status', { type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleTransitionClick = (status) => {
        if (status === OrderStatus.REJECTED) {
            setRejectReason('');
            setRejectDialogOpen(true);
            return;
        }
        applyStatusChange(status);
    };

    const handleRejectConfirm = () => {
        if (!rejectReason.trim()) {
            notify('A rejection reason is required', { type: 'warning' });
            return;
        }
        setRejectDialogOpen(false);
        applyStatusChange(OrderStatus.REJECTED, rejectReason.trim());
    };

    const address = record.addressDto;

    return (
        <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
            <BackButton />

            <Paper sx={{ p: 3, mt: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="h5">Order {record.number}</Typography>
                    <Chip
                        label={record.status}
                        color={OrderStatusColors[record.status] ?? 'default'}
                    />
                </Stack>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Chef</Typography>
                        <Typography>{record.chefName}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Receiver</Typography>
                        <Typography>{record.receiverName}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Phone</Typography>
                        <Typography>{record.receiverPhoneNumber}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                        <Typography>{record.receiverEmail}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Payment</Typography>
                        <Typography>{record.paymentType}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="subtitle2" color="text.secondary">Delivery method</Typography>
                        <Typography>{record.deliveryMethod}</Typography>
                    </Grid>
                </Grid>

                {address && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                        <Typography>
                            {[address.city, address.street, address.building, address.apartment]
                                .filter(Boolean)
                                .join(', ')}
                        </Typography>
                        {address.note && (
                            <Typography color="text.secondary" variant="body2">{address.note}</Typography>
                        )}
                    </>
                )}

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Note
                </Typography>
                {/* FM-BUG-08 */}
                <Typography
                    component="div"
                    sx={{ whiteSpace: 'pre-line' }}
                    dangerouslySetInnerHTML={{ __html: record.note }}
                />

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Items
                </Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Dish</TableCell>
                            <TableCell align="right">Quantity</TableCell>
                            <TableCell align="right">Price</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(record.orderDishList ?? []).map((line, index) => (
                            <TableRow key={line.id ?? index}>
                                <TableCell>{line.dishName ?? line.nameEn}</TableCell>
                                <TableCell align="right">{line.quantity}</TableCell>
                                <TableCell align="right">{line.price}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Divider sx={{ my: 2 }} />
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="h6">Total</Typography>
                    <Typography variant="h6">{record.totalPrice} AMD</Typography>
                </Stack>

                <CustomerReview status={record.status} review={record.review} />

                {availableTransitions.length > 0 && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Change status
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            {availableTransitions.map((status) => (
                                <Button
                                    key={status}
                                    variant="outlined"
                                    color={status === OrderStatus.REJECTED ? 'error' : 'primary'}
                                    disabled={loading}
                                    onClick={() => handleTransitionClick(status)}
                                >
                                    Mark as {status}
                                </Button>
                            ))}
                        </Stack>
                    </>
                )}
            </Paper>

            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Reject order</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        minRows={3}
                        label="Rejection reason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleRejectConfirm}>
                        Reject order
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

const OrderShow = () => (
    <Show component="div">
        <OrderDetails />
    </Show>
);

export default OrderShow;
