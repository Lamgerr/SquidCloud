export default function sitesVisibility(slug: string, options: {
    public?: boolean;
    private?: boolean;
}): Promise<void>;
