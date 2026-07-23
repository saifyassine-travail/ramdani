<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class StockItem extends Model
{
    use HasFactory;

    protected $table = 'stock_items';
    protected $primaryKey = 'ID_Stock';

    protected $fillable = [
        'name', 'quantity', 'threshold', 'unit', 'supplier',
        'purchase_price', 'expiration_date', 'archived',
    ];

    protected $casts = [
        'expiration_date' => 'date',
    ];

    protected $appends = ['is_low_stock', 'is_expiring_soon'];

    public function getIsLowStockAttribute(): bool
    {
        if ($this->threshold === null) {
            return false;
        }
        return $this->quantity <= $this->threshold;
    }

    public function getIsExpiringSoonAttribute(): bool
    {
        if (!$this->expiration_date) {
            return false;
        }
        $today = Carbon::now()->startOfDay();
        $expiration = Carbon::parse($this->expiration_date)->startOfDay();
        // Upcoming within 30 days — already-past dates are flagged separately
        // (as "expired") by the frontend comparing the raw date directly.
        return $expiration->greaterThanOrEqualTo($today) && $today->diffInDays($expiration) <= 30;
    }
}
