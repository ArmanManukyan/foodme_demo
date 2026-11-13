import { useGetList, useCreatePath, Link } from 'react-admin';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Avatar,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Chip,
    Stack,
    Skeleton,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PaymentsIcon from '@mui/icons-material/Payments';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalDiningIcon from '@mui/icons-material/LocalDining';
import { NON_REVENUE_STATUSES, OrderStatus, OrderStatusColors } from '../constants/OrderStatus.jsx';

const currency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AMD', maximumFractionDigits: 0 }).format(
        value ?? 0
    );

const StatCard = ({ icon, label, value, color, loading }) => (
    <Card sx={{ height: '100%' }}>
        <CardContent>
            <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: `${color}.main`, width: 48, height: 48 }} variant="rounded">
                    {icon}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {label}
                    </Typography>
                    {loading ? (
                        <Skeleton width={80} height={32} />
                    ) : (
                        <Typography variant="h5" fontWeight={700} noWrap>
                            {value}
                        </Typography>
                    )}
                </Box>
            </Stack>
        </CardContent>
    </Card>
);

const Dashboard = () => {
    const createPath = useCreatePath();

    // Counts come straight from each resource's `count` (perPage=1 is enough).
    const { total: orderCount, isLoading: ordersCountLoading } = useGetList('orders', {
        pagination: { page: 1, perPage: 1 },
    });
    const { total: chefCount, isLoading: chefsLoading } = useGetList('chefs', {
        pagination: { page: 1, perPage: 1 },
    });
    const { total: dishCount, isLoading: dishesLoading } = useGetList('dishes', {
        pagination: { page: 1, perPage: 1 },
    });

    // Recent orders drive both the "recent revenue" sum and the table below.
    // No aggregate endpoint exists, so revenue is summed client-side over the
    // most recent orders — an approximation, not an all-time total.
    const { data: recentOrders = [], isLoading: recentLoading } = useGetList('orders', {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'createdAt', order: 'DESC' },
    });

    const recentRevenue = recentOrders
        .filter((o) => !NON_REVENUE_STATUSES.includes(o.status))
        .reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);

    const statusCounts = recentOrders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
    }, {});

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
                Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Overview of orders, chefs and dishes
            </Typography>

            <Grid container spacing={2.5} sx={{ mb: 1 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<ShoppingCartIcon />}
                        label="Total orders"
                        value={orderCount ?? 0}
                        color="primary"
                        loading={ordersCountLoading}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<PaymentsIcon />}
                        label="Recent revenue"
                        value={currency(recentRevenue)}
                        color="secondary"
                        loading={recentLoading}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<RestaurantIcon />}
                        label="Chefs"
                        value={chefCount ?? 0}
                        color="warning"
                        loading={chefsLoading}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<LocalDiningIcon />}
                        label="Dishes"
                        value={dishCount ?? 0}
                        color="info"
                        loading={dishesLoading}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                Recent orders
                            </Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Number</TableCell>
                                        <TableCell>Chef</TableCell>
                                        <TableCell>Receiver</TableCell>
                                        <TableCell align="right">Total</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {recentLoading &&
                                        [...Array(5)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={5}>
                                                    <Skeleton height={28} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    {!recentLoading && recentOrders.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                                    No orders yet.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!recentLoading &&
                                        recentOrders.slice(0, 8).map((order) => (
                                            <TableRow
                                                key={order.id}
                                                component={Link}
                                                to={createPath({ resource: 'orders', id: order.id, type: 'show' })}
                                                sx={{
                                                    textDecoration: 'none',
                                                    cursor: 'pointer',
                                                    '&:hover': { backgroundColor: '#FFF7ED' },
                                                }}
                                            >
                                                <TableCell>{order.number}</TableCell>
                                                <TableCell>{order.chefName}</TableCell>
                                                <TableCell>{order.receiverName}</TableCell>
                                                <TableCell align="right">{currency(order.totalPrice)}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={order.status}
                                                        size="small"
                                                        color={OrderStatusColors[order.status] ?? 'default'}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                Orders by status
                            </Typography>
                            <Stack spacing={1.5}>
                                {Object.values(OrderStatus).map((status) => (
                                    <Stack
                                        key={status}
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                    >
                                        <Chip
                                            label={status}
                                            size="small"
                                            color={OrderStatusColors[status] ?? 'default'}
                                        />
                                        <Typography variant="body2" fontWeight={600}>
                                            {recentLoading ? '—' : statusCounts[status] ?? 0}
                                        </Typography>
                                    </Stack>
                                ))}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                                Based on the {recentLoading ? '' : recentOrders.length} most recent orders.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
