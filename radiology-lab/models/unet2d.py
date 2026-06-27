"""Small 2D U-Net (MONAI) for KiTS kidney segmentation (~1M params on defaults)."""
from monai.networks.nets import UNet


def build_unet2d(channels=(16, 32, 64, 128), strides=(2, 2, 2),
                 in_channels: int = 1, out_channels: int = 2) -> UNet:
    return UNet(
        spatial_dims=2,
        in_channels=in_channels,
        out_channels=out_channels,   # 2 = background + kidney
        channels=tuple(channels),
        strides=tuple(strides),
        num_res_units=2,
        norm="batch",
    )
