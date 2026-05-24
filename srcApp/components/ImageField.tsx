interface Props {
	value: { src: string; placeholder: string };
	onChange: (next: { src: string; placeholder: string }) => void;
}

export function ImageField({ value, onChange }: Props) {
	const inputClass =
		"w-full px-3 py-2 rounded-md bg-surface2 border border-white/10 text-text text-sm focus:border-gold focus:outline-none";

	return (
		<div className="flex flex-col gap-3">
			<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
				Image
			</span>
			<label className="flex flex-col gap-1">
				<span className="text-text-muted text-[10px] tracking-wider uppercase">
					High-res src
				</span>
				<input
					type="url"
					value={value.src}
					onInput={(e) =>
						onChange({ ...value, src: (e.target as HTMLInputElement).value })
					}
					placeholder="https://…/dish-1200x800.jpg"
					className={inputClass}
				/>
			</label>
			<label className="flex flex-col gap-1">
				<span className="text-text-muted text-[10px] tracking-wider uppercase">
					Low-res placeholder (optional)
				</span>
				<input
					type="url"
					value={value.placeholder}
					onInput={(e) =>
						onChange({
							...value,
							placeholder: (e.target as HTMLInputElement).value,
						})
					}
					placeholder="https://…/dish-40x27.jpg"
					className={inputClass}
				/>
			</label>
			{value.src && (
				<div className="relative aspect-[16/9] overflow-hidden rounded-md bg-surface2 border border-white/[0.07]">
					{value.placeholder && (
						<img
							src={value.placeholder}
							alt=""
							aria-hidden="true"
							className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
						/>
					)}
					<img
						src={value.src}
						alt="Preview"
						className="absolute inset-0 w-full h-full object-cover"
					/>
				</div>
			)}
		</div>
	);
}
