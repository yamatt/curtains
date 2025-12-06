from .args import get_args


def main():
    args = get_args()
    args.func(args)


if __name__ == "__main__":
    main()
