interface Props {
	price: { amount: string; currency: string };
	freeform: string;
	onPriceChange: (next: { amount: string; currency: string }) => void;
	onFreeformChange: (next: string) => void;
}

const COMMON_CURRENCIES = ["€", "$", "£", "¥", "₽", "₺", "CHF", "kr"];

export function PriceField({
	price,
	freeform,
	onPriceChange,
	onFreeformChange,
}: Props) {
	const inputClass =
		"w-full px-3 py-2 rounded-md bg-surface2 border border-white/10 text-text text-sm focus:border-gold focus:outline-none";

	return (
		<div className="flex flex-col gap-3">
			<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
				Price
			</span>
			<div className="grid grid-cols-[1fr_6rem] gap-2">
				<label className="flex flex-col gap-1">
					<span className="text-text-muted text-[10px] tracking-wider uppercase">
						Amount
					</span>
					<input
						type="number"
						step="0.01"
						inputMode="decimal"
						value={price.amount}
						onInput={(e) =>
							onPriceChange({
								...price,
								amount: (e.target as HTMLInputElement).value,
							})
						}
						placeholder="0.00"
						disabled={freeform.length > 0}
						className={`${inputClass} disabled:opacity-50`}
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-text-muted text-[10px] tracking-wider uppercase">
						Currency
					</span>
					<input
						type="text"
						list="currency-suggestions"
						value={price.currency}
						onInput={(e) =>
							onPriceChange({
								...price,
								currency: (e.target as HTMLInputElement).value,
							})
						}
						placeholder="€"
						disabled={freeform.length > 0}
						className={`${inputClass} disabled:opacity-50`}
					/>
					<datalist id="currency-suggestions">
						{COMMON_CURRENCIES.map((c) => (
							<option key={c} value={c} />
						))}
					</datalist>
				</label>
			</div>
			<label className="flex flex-col gap-1">
				<span className="text-text-muted text-[10px] tracking-wider uppercase">
					Or free-form (e.g. "Market price")
				</span>
				<input
					type="text"
					value={freeform}
					onInput={(e) =>
						onFreeformChange((e.target as HTMLInputElement).value)
					}
					placeholder="Leave blank to use amount/currency"
					className={inputClass}
				/>
			</label>
		</div>
	);
}
